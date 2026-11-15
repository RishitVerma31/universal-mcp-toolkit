import test from "node:test";
import assert from "node:assert/strict";
import {
	formatJson,
	handleJsonFormat,
	jsonFormatInputSchema,
} from "../../src/tools/developer/json-format.ts";

test("json_format: formats valid JSON with default indentation (2)", () => {
	const raw = '{"name":"toolkit","version":1}';
	const formatted = formatJson(raw);
	assert.equal(formatted, '{\n  "name": "toolkit",\n  "version": 1\n}');
});

test("json_format: formats JSON with indentation 0 (compact)", () => {
	const raw = '{\n  "a": 1,\n  "b": 2\n}';
	const formatted = formatJson(raw, 0);
	assert.equal(formatted, '{"a":1,"b":2}');
});

test("json_format: formats JSON with indentation 4 and 8", () => {
	const raw = '{"key":"value"}';
	const formatted4 = formatJson(raw, 4);
	assert.equal(formatted4, '{\n    "key": "value"\n}');

	const formatted8 = formatJson(raw, 8);
	assert.equal(formatted8, '{\n        "key": "value"\n}');
});

test("json_format: formats complex nested JSON structure without modifying data", () => {
	const data = {
		string: "hello",
		number: 123.45,
		boolean: true,
		nullable: null,
		array: [1, "two", false],
		nested: {
			inner: "val",
		},
	};
	const raw = JSON.stringify(data);
	const formatted = formatJson(raw, 2);
	assert.deepEqual(JSON.parse(formatted), data);
});

test("json_format: throws error for invalid JSON string", () => {
	assert.throws(
		() => formatJson('{"broken": json}'),
		/Unexpected token|Expected property name|JSON/,
	);
});

test("json_format: handler returns successful tool result for valid input", async () => {
	const result = await handleJsonFormat({
		json: '{"ok":true}',
		indent: 2,
	});

	assert.equal(result.isError, undefined);
	assert.equal(result.content.length, 1);
	assert.equal(result.content[0].type, "text");
	assert.equal(result.content[0].text, '{\n  "ok": true\n}');
});

test("json_format: handler returns error result for invalid JSON string", async () => {
	const result = await handleJsonFormat({
		json: "not valid json",
		indent: 2,
	});

	assert.equal(result.isError, true);
	assert.equal(result.content.length, 1);
	assert.equal(result.content[0].type, "text");
	assert.match(result.content[0].text, /^Invalid JSON:/);
});

test("json_format: schema validation handles defaults and rejects invalid bounds", () => {
	const defaultParsed = jsonFormatInputSchema.parse({ json: "{}" });
	assert.equal(defaultParsed.indent, 2);

	assert.throws(() => {
		jsonFormatInputSchema.parse({ json: "{}", indent: -1 });
	});

	assert.throws(() => {
		jsonFormatInputSchema.parse({ json: "{}", indent: 9 });
	});

	assert.throws(() => {
		jsonFormatInputSchema.parse({ json: "{}", indent: 2.5 });
	});

	assert.throws(() => {
		jsonFormatInputSchema.parse({});
	});
});
