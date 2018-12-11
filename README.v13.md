# ![Yjs](https://user-images.githubusercontent.com/5553757/48975307-61efb100-f06d-11e8-9177-ee895e5916e5.png)
> A CRDT library with a powerful abstraction of shared data

Yjs v13 is a work in progress.

### Typescript Declarations

Until [this](https://github.com/Microsoft/TypeScript/issues/7546) is fixed, the only way to get type declarations is by adding Yjs to the list of checked files:

```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    ..
  },
  "include": [
    "./node_modules/yjs/"
  ]
}
```
