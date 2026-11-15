import test from "node:test";
import assert from "node:assert/strict";
import {
	hashText,
	handleHashText,
	hashTextInputSchema,
} from "../../src/tools/developer/hash-text.ts";

test("hash_text: SHA-256 known test vector for 'hello world'", async () => {
	const hash = await hashText("hello world", "SHA-256");
	assert.equal(hash, "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
	assert.equal(hash.length, 64);
	assert.equal(hash, hash.toLowerCase());
});

test("hash_text: SHA-256 empty string test vector", async () => {
	const hash = await hashText("", "SHA-256");
	assert.equal(hash, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});

test("hash_text: SHA-384 known test vector for 'hello world'", async () => {
	const hash = await hashText("hello world", "SHA-384");
	assert.equal(
		hash,
		"fdbd8e75a67f29f701a4e040385e2e23986303ea10239211af907fcbb83578b3e417cb71ce646efd0819dd8c088de1bd",
	);
	assert.equal(hash.length, 96);
	assert.equal(hash, hash.toLowerCase());
});

test("hash_text: SHA-512 known test vector for 'hello world'", async () => {
	const hash = await hashText("hello world", "SHA-512");
	assert.equal(
		hash,
		"309ecc489c12d6eb4cc40f50c902f2b4d0ed77ee511a7c7a9bcd3ca86d4cd86f989dd35bc5ff499670da34255b45b0cfd830e81f605dcf7dc5542e93ae9cd76f",
	);
	assert.equal(hash.length, 128);
	assert.equal(hash, hash.toLowerCase());
});

test("hash_text: handles Unicode and emoji characters properly", async () => {
	const text = "Hello 🌍 🚀 世界";
	const hash256 = await hashText(text, "SHA-256");
	assert.equal(hash256.length, 64);
	assert.equal(hash256, hash256.toLowerCase());
});

test("hash_text: handler returns successful tool result with default algorithm", async () => {
	const result = await handleHashText({
		text: "hello world",
		algorithm: "SHA-256",
	});
	assert.equal(result.isError, undefined);
	assert.equal(
		result.content[0].text,
		"b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
	);
});

test("hash_text: schema validation defaults algorithm to SHA-256 and rejects MD5/SHA-1", () => {
	const parsed = hashTextInputSchema.parse({ text: "test" });
	assert.equal(parsed.algorithm, "SHA-256");

	assert.throws(() => {
		hashTextInputSchema.parse({ text: "test", algorithm: "MD5" });
	});

	assert.throws(() => {
		hashTextInputSchema.parse({ text: "test", algorithm: "SHA-1" });
	});
});
