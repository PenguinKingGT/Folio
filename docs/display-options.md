# Apple display options (F32)

`Book.displayOptions` exposes a frozen parsed snapshot or `null` when no applicable file is discovered. The legacy file is `META-INF/com.apple.ibooks.display-options.xml`. Apple's guides distinguish [legacy display options](https://help.apple.com/itc/booksassetguide/en.lproj/itce589a46ad.html) from [EPUB 3 OPF layout metadata](https://help.apple.com/itc/booksassetguide/en.lproj/itc2cf4d26eb.html); modern package preferences take precedence in Folio.

```xml
<display_options>
  <platform name="*">
    <option name="fixed-layout">true</option>
    <option name="open-to-spread">true</option>
    <option name="orientation-lock">landscape-only</option>
    <option name="interactive">true</option>
  </platform>
</display_options>
```

`parseAppleDisplayOptions(xml, platform?)` is exported for headless use. `platform` is `*` (default), `ipad`, or `iphone`; Book callers use `applePlatform`. Direct root options form defaults, wildcard options override them, and the selected platform overrides the wildcard regardless of XML order. A platform without a name is treated as `iphone`. Unselected platforms and unknown option names do not affect the result. Duplicate applicable platforms/known option names, invalid values, malformed XML, and DTD declarations reject.

| Snapshot field    | Values                                            | Folio behavior                                                                                                                                                                              |
| ----------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fixedLayout`     | `true`, `false`, `null`                           | Supplies missing package `layout` as `pre-paginated` or `reflowable`; both readers reuse their existing geometry.                                                                           |
| `openToSpread`    | `true`, `false`, `null`                           | Interpreted as a missing fixed-layout spread default, `both` or `none`. Bounded readers can pair facing pages; explicit host settings and modern package/item properties retain precedence. |
| `orientationLock` | `landscape-only`, `portrait-only`, `none`, `null` | Supplies missing `orientation` metadata as `landscape`, `portrait`, or `auto`; the host may use this preference.                                                                            |
| `interactive`     | `true`, `false`, `null`                           | Retained as metadata. It grants no script, popup, navigation, or device permissions.                                                                                                        |

Null means absent; explicit false is preserved. Unlike Apple's initial-opening description, Folio treats `open-to-spread` as a persistent legacy default that callers can override through reader layout settings. Continuous readers retain individual fixed-page containing blocks and their normal continuous scroll behavior. Orientation is advisory: the library does not change global device orientation or require fullscreen. Passive scripts remain disabled regardless of `interactive`.

Archive discovery uses known ZIP entries without requesting a missing file. Directory discovery runs automatically only when package layout is absent. Direct OPF/JSON documents have no inferred container directory, so discovery requires `{ appleDisplayOptions: true }` and uses their existing origin-root resource provider. The same option forces directory probing despite modern layout metadata; `false` disables discovery altogether. Explicitly selected platform and discovery options are validated before source I/O.

Only HTTP 404 and an offline optional-resource miss mean absent during network discovery. Server failures, invalid UTF-8, malformed present XML, and cancellation propagate through Book opening and its normal cleanup. Modern metadata wins even when a legacy file is present. User settings remain above publication defaults. Locally authored EPUB 2/NCX fixtures verify discovery, platform/metadata precedence, false values, failure paths, native fixed viewports/spreads, continuous pages, and script isolation across Chromium, Firefox, and WebKit.
