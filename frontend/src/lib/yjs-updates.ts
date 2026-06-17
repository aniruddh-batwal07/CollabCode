import * as Y from "yjs";

const doc1 = new Y.Doc();

const text1 = doc1.getText("editor");

text1.insert(0, "Hello");

const update = Y.encodeStateAsUpdate(doc1);

const doc2 = new Y.Doc();

Y.applyUpdate(doc2, update);

console.log(
  doc2.getText("editor").toString()
);