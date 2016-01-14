
# Rich Text type for [Yjs](https://github.com/y-js/richtext)

This type strongly resembles the [rich text](https://github.com/ottypes/rich-text) format for operational transformation. Under the hood, however, several mechanisms ensure that the intentions of your changes are preserved. Furthermore, you can transform the actions on the document in the rich text format back and forth, and, therefore, you can bind this type to any rich text editor that supports the widely used rich text format.


## Use it!
Retrieve this with bower or npm.

##### Bower
```
bower install y-richtext --save
```

and include the js library.

```
<script src="./bower_components/y-richtext/y-richtext.js"></script>
```

##### NPM
```
npm install y-richtext --save
```
and put it on the `Y` object.

```
Y.RichText = require("y-richtext");
```


### RichText Object

##### Reference
* Create
```
var yrichtext = new Y.RichText()
```
* Create
```
var yrichtext = new Y.RichText(ot_delta)
```
* .bind(editor)
  * Bind this type to an rich text editor. (Currently, only QuillJs is supported)


# A note on intention preservation
This type has several mechanisms to ensure that the intention of your actions are preserved. For example:
* If two users fix a word concurrently, only one change will prevail. A classical example is that two users want to correct the word "missplled". If two users correct it at the same time (or they merge after they corrected it offline), the result in operation transformation algorithms would be "misspeelled". This type will ensure that the result is "misspelled"
* When a user inserts content *c* after a set of content *C_left*, and before a set of content *C_right*, then *C_left* will be always to the left of c, and *C_right* will be always to the right of *c*. This property will also hold when content is deleted or when a deletion is undone.

## Contribution
We thank [Veeting](https://www.veeting.com/) and [Linagora](https://www.linagora.com/) who sponsored this work, and agreed to publish it as Open Source.

## License
Yjs and the RichText type are licensed under the [MIT License](./LICENSE.txt).

- Corentin Cadiou <corentin.cadiou@linagora.com>
- Kevin Jahns <kevin.jahns@rwth-aachen.de>
