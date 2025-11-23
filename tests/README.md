<!-- 
### Note 

Mocha, Vitest, and Jest depend on `glob`. Older versions of `glob` (versions less than 7) depend on `inflight@1.0.6`, which has a memory leak issue. To fix this, we need to force the use of `glob` version 9 or higher. This can be achieved by adding the `overrides` field in your `package.json`.

Here's an example:

```json
{
  "devDependencies": {
    "jest": "^30.2.0"
  },
  "overrides": {
    "glob": "10.5.0"
  }
}
```

This will ensure that npm uses the specified version of `glob`, avoiding the deprecated `inflight` package. 

-->
