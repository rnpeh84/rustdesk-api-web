# SVG 심볼을 기준으로 PNG와 다중 해상도 ICO를 만든다. Windows 기본 그래픽 API만 사용한다.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$taskRoot = Split-Path $PSScriptRoot -Parent
[xml]$taskSvg = Get-Content -LiteralPath (Join-Path $taskRoot 'src/assets/solution-mark.svg') -Raw
$taskPublic = Join-Path $taskRoot 'public'

function New-BrandPng([int]$Size) {
    $bitmap = [System.Drawing.Bitmap]::new($Size * 4, $Size * 4)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.ScaleTransform($Size * 4 / 48, $Size * 4 / 48)
    try {
        $rect = $taskSvg.svg.rect
        $radius = [float]$rect.rx
        $outline = [System.Drawing.Drawing2D.GraphicsPath]::new()
        $outline.AddArc(0, 0, $radius * 2, $radius * 2, 180, 90)
        $outline.AddArc(48 - $radius * 2, 0, $radius * 2, $radius * 2, 270, 90)
        $outline.AddArc(48 - $radius * 2, 48 - $radius * 2, $radius * 2, $radius * 2, 0, 90)
        $outline.AddArc(0, 48 - $radius * 2, $radius * 2, $radius * 2, 90, 90)
        $outline.CloseFigure()
        $brush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($rect.fill))
        $graphics.FillPath($brush, $outline)
        $brush.Dispose(); $outline.Dispose()
        foreach ($circle in $taskSvg.svg.circle) {
            $brush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($circle.fill))
            $r = [float]$circle.r
            $graphics.FillEllipse($brush, [float]$circle.cx - $r, [float]$circle.cy - $r, $r * 2, $r * 2)
            $brush.Dispose()
        }
        foreach ($element in $taskSvg.svg.path) {
            # 현재 심볼은 직선 명령만 사용한다. 알 수 없는 형식은 생략하지 않고 중단한다.
            if ($element.d -match '[^MLHV0-9.\s-]') { throw '지원하지 않는 SVG 경로 명령입니다.' }
            $tokens = [regex]::Matches($element.d, '[MLHV]|-?\d+(?:\.\d+)?') | ForEach-Object Value
            $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
            $x = 0.0; $y = 0.0
            for ($i = 0; $i -lt $tokens.Count;) {
                $command = $tokens[$i++]
                $nextX = $x; $nextY = $y
                switch ($command) {
                    'M' { $x = [float]::Parse($tokens[$i++], [cultureinfo]::InvariantCulture); $y = [float]::Parse($tokens[$i++], [cultureinfo]::InvariantCulture); $path.StartFigure() }
                    'L' { $nextX = [float]::Parse($tokens[$i++], [cultureinfo]::InvariantCulture); $nextY = [float]::Parse($tokens[$i++], [cultureinfo]::InvariantCulture) }
                    'H' { $nextX = [float]::Parse($tokens[$i++], [cultureinfo]::InvariantCulture) }
                    'V' { $nextY = [float]::Parse($tokens[$i++], [cultureinfo]::InvariantCulture) }
                    default { throw 'SVG 경로 좌표를 해석할 수 없습니다.' }
                }
                if ($command -eq 'M') { continue }
                $path.AddLine([float]$x, [float]$y, [float]$nextX, [float]$nextY)
                $x = $nextX; $y = $nextY
            }
            $pen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml($element.stroke), [float]$element.'stroke-width')
            $pen.StartCap = $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
            $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
            $graphics.DrawPath($pen, $path)
            $pen.Dispose(); $path.Dispose()
        }
        $result = [System.Drawing.Bitmap]::new($Size, $Size)
        $scaled = [System.Drawing.Graphics]::FromImage($result)
        $scaled.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $scaled.DrawImage($bitmap, 0, 0, $Size, $Size)
        $stream = [System.IO.MemoryStream]::new()
        try {
            $result.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
            return ,$stream.ToArray()
        } finally { $stream.Dispose(); $scaled.Dispose(); $result.Dispose() }
    } finally { $graphics.Dispose(); $bitmap.Dispose() }
}

$sizes = @(16, 32, 64, 256)
$images = @($sizes | ForEach-Object { ,(New-BrandPng $_) })
$iconStream = [System.IO.MemoryStream]::new()
$writer = [System.IO.BinaryWriter]::new($iconStream)
try {
    $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$sizes.Count)
    $offset = 6 + 16 * $sizes.Count
    for ($i = 0; $i -lt $sizes.Count; $i++) {
        $dimension = if ($sizes[$i] -eq 256) { 0 } else { $sizes[$i] }
        $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
        $writer.Write([byte]0); $writer.Write([byte]0)
        $writer.Write([uint16]1); $writer.Write([uint16]32)
        $writer.Write([uint32]$images[$i].Length); $writer.Write([uint32]$offset)
        $offset += $images[$i].Length
    }
    foreach ($bytes in $images) { $writer.Write([byte[]]$bytes) }
    [System.IO.File]::WriteAllBytes((Join-Path $taskPublic 'favicon.ico'), $iconStream.ToArray())
    [System.IO.File]::WriteAllBytes((Join-Path $taskPublic 'apple-touch-icon.png'), (New-BrandPng 180))
    [System.IO.File]::WriteAllBytes((Join-Path $taskPublic 'solution-icon-256.png'), (New-BrandPng 256))
} finally { $writer.Dispose(); $iconStream.Dispose() }
foreach ($variant in @(
    @{ Name = 'rede-logo.svg'; Text = '#242424'; Accent = '#126D85' },
    @{ Name = 'rede-logo-dark.svg'; Text = '#F5F5F5'; Accent = '#7ADCF5' }
)) {
    $wordmark = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="48" viewBox="0 0 200 48" fill="none" role="img" aria-labelledby="title"><title id="title">Re;De · Remote Desktop</title>' + $taskSvg.svg.InnerXml + '<text x="64" y="31" fill="' + $variant.Text + '" font-family="Segoe UI, Arial, sans-serif" font-size="36" font-weight="650" letter-spacing="-1.98">Re<tspan fill="' + $variant.Accent + '">;</tspan>De</text><text x="64" y="46" fill="' + $variant.Text + '" font-family="Segoe UI, Arial, sans-serif" font-size="10" letter-spacing="0.55">Remote Desktop</text></svg>'
    [System.IO.File]::WriteAllText((Join-Path $taskPublic $variant.Name), $wordmark, [System.Text.UTF8Encoding]::new($false))
}
Write-Output 'Re;De 아이콘 생성 완료: ICO 16/32/64/256px, PNG 180/256px'
