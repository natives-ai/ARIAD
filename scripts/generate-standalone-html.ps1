$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$DistAssetsDir = Join-Path $Root "frontend\dist\assets"
$ServiceEntryPath = Join-Path $Root "frontend\dist\service.html"
$TargetPath = Join-Path $Root "ARIAD.html"

$ServiceEntry = Get-Content -LiteralPath $ServiceEntryPath -Raw -Encoding UTF8
$CssMatch = [regex]::Match($ServiceEntry, 'href="/assets/(?<css>main-[^"]+\.css)"')
$JsMatch = [regex]::Match($ServiceEntry, 'src="/assets/(?<js>main-[^"]+\.js)"')

if (-not $CssMatch.Success) {
  throw "Could not find the built CSS asset reference in $ServiceEntryPath"
}

if (-not $JsMatch.Success) {
  throw "Could not find the built JS asset reference in $ServiceEntryPath"
}

$CssAsset = Get-Item -LiteralPath (Join-Path $DistAssetsDir $CssMatch.Groups["css"].Value)
$JsAsset = Get-Item -LiteralPath (Join-Path $DistAssetsDir $JsMatch.Groups["js"].Value)

if (-not $CssAsset) {
  throw "No built CSS asset was found in $DistAssetsDir"
}

if (-not $JsAsset) {
  throw "No built JS asset was found in $DistAssetsDir"
}

$Css = Get-Content -LiteralPath $CssAsset.FullName -Raw -Encoding UTF8
$Js = Get-Content -LiteralPath $JsAsset.FullName -Raw -Encoding UTF8

$Html = @"
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ARIAD</title>
    <style>
$Css
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script>
      window.__ARIAD_STANDALONE__ = true;
    </script>
    <script type="module">
$Js
    </script>
  </body>
</html>
"@

Set-Content -LiteralPath $TargetPath -Value $Html -Encoding UTF8
Write-Host "Generated standalone ARIAD.html from $($CssAsset.Name) and $($JsAsset.Name)"
