1) Copy the folders app, components, lib, supabase, tests into your project folder
   and choose "Replace the files in the destination".
2) Delete the old discount files: open PowerShell IN YOUR PROJECT FOLDER and run
     powershell -ExecutionPolicy Bypass -File "C:\path\to\pricing-v2\delete-old-files.ps1"
   (or delete the files listed in DELETE-THESE-FILES.txt by hand).
3) In YOUR package.json replace the "test:logic" line with:
   "test:logic": "node --import ./tests/register.mjs --test tests/logic.test.mjs tests/release-routing.test.mjs tests/coupons.test.mjs tests/ledger.test.mjs"
