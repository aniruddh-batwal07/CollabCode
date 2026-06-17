import * as Y from "yjs";

const doc = new Y.Doc();

const text = doc.getText("editor");

text.insert(0, "Hello");

console.log(text.toString());