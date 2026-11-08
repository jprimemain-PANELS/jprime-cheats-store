# Removes the discount/bulk files from the previous package. Run from your PROJECT folder.
$files = @(
  "app\api\admin\discounts\route.ts",
  "app\api\admin\price-book\route.ts",
  "app\api\admin\price-bulk\route.ts",
  "app\api\admin\vip-bulk\route.ts",
  "app\api\discounts\route.ts",
  "components\admin\BulkPriceTool.tsx",
  "components\admin\DiscountManager.tsx",
  "components\admin\bulk-controls.tsx",
  "lib\discounts-server.ts",
  "lib\discounts.ts",
  "lib\price-book.ts",
  "lib\price-math.ts",
  "lib\useDiscounts.ts",
  "tests\pricing.test.mjs"
)
foreach ($f in $files) {
  if (Test-Path $f) { Remove-Item $f -Force; Write-Host "deleted   $f" } else { Write-Host "not found $f" }
}
foreach ($d in @("app\api\admin\discounts","app\api\admin\price-book","app\api\admin\price-bulk","app\api\admin\vip-bulk","app\api\discounts")) {
  if ((Test-Path $d) -and -not (Get-ChildItem $d -Force)) { Remove-Item $d -Force }
}
