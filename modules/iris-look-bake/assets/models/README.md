# AnimeGANv3 weights (Shinkai / Hayao)

- `AnimeGANv3_Shinkai_37.onnx` — Makoto Shinkai style
- `AnimeGANv3_Hayao_36.onnx` — Hayao Miyazaki style

Each generator is NHWC float, dynamic H×W (prefer multiples of 8, min side 256), Tanh out (~4 MB).

Sources (official release v1.1.0):

- [AnimeGANv3_Shinkai_37.onnx](https://github.com/TachibanaYoshino/AnimeGANv3/releases/download/v1.1.0/AnimeGANv3_Shinkai_37.onnx)
- [AnimeGANv3_Hayao_36.onnx](https://github.com/TachibanaYoshino/AnimeGANv3/releases/download/v1.1.0/AnimeGANv3_Hayao_36.onnx)

Upstream: [TachibanaYoshino/AnimeGANv3](https://github.com/TachibanaYoshino/AnimeGANv3)

Refresh / verify:

```bash
python3 modules/iris-look-bake/scripts/fetch_animegan_models.py
```

iOS: `ios/*.onnx` symlinks → these files, listed in `IrisLookBake.podspec` `resource_bundles`. After adding models run `cd ios && pod install` and rebuild the native app. Android reads them from module assets (`assets.srcDirs`).

Preprocess: `x = pixel / 127.5 - 1`. Postprocess: `pixel = (y + 1) * 127.5`. Iris scales to max side 1024, aligned to 8.
