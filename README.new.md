
### Typescript Declarations

Until [this](https://github.com/Microsoft/TypeScript/issues/7546) is fixed, the only way to get type declarations is by adding Yjs to the list of checked files:

```json
{
  "checkJs": true,
  "include": [
    "./node_modules/yjs/"
  ]
  ..
}
```
