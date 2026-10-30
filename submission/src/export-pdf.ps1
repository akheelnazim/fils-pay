# Exports the .docx and .pptx in submission/ to PDF with Word and PowerPoint.
# Usage: powershell -File export-pdf.ps1 [doc|deck|both]
param([string]$What = "both")
$root = Split-Path -Parent $PSScriptRoot

if ($What -eq "doc" -or $What -eq "both") {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  try {
    $d = $word.Documents.Open("$root\LGTM_FilsPay_Submission.docx")
    foreach ($t in $d.TablesOfContents) { $t.Update() }
    $d.Save()
    $d.ExportAsFixedFormat("$root\LGTM_FilsPay_Submission.pdf", 17)
    $d.Close()
  } finally { $word.Quit() }
}
if ($What -eq "deck" -or $What -eq "both") {
  $pp = New-Object -ComObject PowerPoint.Application
  try {
    $p = $pp.Presentations.Open("$root\LGTM_FilsPay_Slides.pptx", $true, $false, $false)
    $p.SaveAs("$root\LGTM_FilsPay_Slides.pdf", 32)
    $p.Close()
  } finally { $pp.Quit() }
}
Write-Output "done"
