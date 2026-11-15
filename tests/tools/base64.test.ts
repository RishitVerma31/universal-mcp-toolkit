import test from "node:test";
import assert from "node:assert/strict";
import {
	base64Encode,
	handleBase64Encode,
	base64EncodeInputSchema,
} from "../../src/tools/developer/base64-encode.ts";
import {
	base64Decode,
	handleBase64Decode,
	base64DecodeInputSchema,
} from "../../src/tools/developer/base64-decode.ts";

test("base64_encode: encodes ASCII text correctly", () => {
	assert.equal(base64Encode("hello world"), "aGVsbG8gd29ybGQ=");
	assert.equal(base64Encode("a"), "YQ==");
	assert.equal(base64Encode("ab"), "YWI=");
	assert.equal(base64Encode("abc"), "YWJj");
});

test("base64_encode: encodes empty string to empty string", () => {
	assert.equal(base64Encode(""), "");
});

test("base64_encode & decode: Unicode and emoji roundtrip", () => {
	const testStrings = [
		"Hello, 🌍 World! 🚀",
		"日本語のテスト - Japanese text",
		"مرحبا بالعالم - Arabic text",
		"Special symbols: © ® ™ 𝄞 𝕏 ⚡️ 💡 🔥",
		"Multi-byte UTF-8: 🧑🏽‍💻 combined family emojis",
	];

	for (const original of testStrings) {
		const encoded = base64Encode(original);
		const decoded = base64Decode(encoded);
		assert.equal(decoded, original, `Failed roundtrip for: ${original}`);
	}
});

test("base64_decode: decodes standard Base64 correctly", () => {
	assert.equal(base64Decode("aGVsbG8gd29ybGQ="), "hello world");
	assert.equal(base64Decode("YQ=="), "a");
	assert.equal(base64Decode("YWI="), "ab");
	assert.equal(base64Decode("YWJj"), "abc");
	assert.equal(base64Decode(""), "");
});

test("base64_decode: rejects invalid Base64 input strings", () => {
	const invalidInputs = [
		"invalid!@#$",
		"abc", // length 3 (not a multiple of 4)
		"a===", // invalid padding
		"====", // invalid padding
		"aGVsbG8", // length 7
		"aGVsbG8==", // length 9
		"abcde", // length 5
		"YWJ j", // space inside
		"YWJ\nj", // newline inside
	];

	for (const invalid of invalidInputs) {
		assert.throws(
			() => base64Decode(invalid),
			/Invalid Base64 string/,
			`Should reject invalid Base64: ${invalid}`,
		);
	}
});

test("base64_decode: rejects Base64 strings that decode into non-UTF-8 bytes", () => {
	// "//8=" in Base64 corresponds to bytes [0xFF, 0xFF], which is not valid UTF-8
	assert.throws(
		() => base64Decode("//8="),
		/Failed to decode Base64 data|valid for encoding utf-8/,
	);
});

test("base64_encode: handler returns successful tool result", async () => {
	const result = await handleBase64Encode({ text: "universal-mcp" });
	assert.equal(result.isError, undefined);
	assert.equal(result.content[0].text, "dW5pdmVyc2FsLW1jcA==");
});

test("base64_decode: handler returns successful tool result", async () => {
	const result = await handleBase64Decode({ encoded: "dW5pdmVyc2FsLW1jcA==" });
	assert.equal(result.isError, undefined);
	assert.equal(result.content[0].text, "universal-mcp");
});

test("base64_decode: handler returns error result on malformed Base64", async () => {
	const result = await handleBase64Decode({ encoded: "not-valid-b64" });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /Invalid Base64 string/);
});

test("base64: schema validation requires strings", () => {
	assert.throws(() => base64EncodeInputSchema.parse({}));
	assert.throws(() => base64DecodeInputSchema.parse({}));
});
