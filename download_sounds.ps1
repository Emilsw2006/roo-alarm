$ErrorActionPreference = "Stop"

$assetsPath = "c:\Users\Emil\misproyectos\miapp\assets\sounds"
if (!(Test-Path -Path $assetsPath)) {
    New-Item -ItemType Directory -Force -Path $assetsPath
}

$sounds = @(
    @{ name="digital_alarm.mp3"; url="https://raw.githubusercontent.com/rafaelreis-hotmart/Audio-Sample-files/master/sample.mp3" },
    @{ name="radar_classic.mp3"; url="https://raw.githubusercontent.com/rafaelreis-hotmart/Audio-Sample-files/master/sample2.mp3" },
    @{ name="rooster.mp3"; url="https://actions.google.com/sounds/v1/animals/rooster_crowing.ogg" },
    @{ name="bell.mp3"; url="https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg" },
    @{ name="emergency.mp3"; url="https://actions.google.com/sounds/v1/alarms/beeping_alarm.ogg" }
)

foreach ($s in $sounds) {
    $dest = Join-Path $assetsPath $s.name
    Write-Host "Downloading $($s.name)..."
    Invoke-WebRequest -Uri $s.url -OutFile $dest
}

Write-Host "Done downloading sounds."
