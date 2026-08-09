### a tutorial on how to access the fortegreen color
*v17.3* \
**actually really important note:** this color will only appear on lobbies hosted by you
1. **disable color check** \
   among us has a built in color check function that prevets using undefined colors \
   by applying the following formula to every color id that is not lower than colorCount: \
   `colorId = (colorId + 1) % colorCount` (`colorCount = 18`) \
   to bypass this open `GameAssembly.dll` (located in the same folder as `Among Us.exe`) in any byte editor (ex. HxD) and replace bytes \
   `5a 18 7d 41` with `5a 18 48 90`. \
   this changes instruction
   ```asm
   JGE 0x18067e473
   ```
   to
   ```asm
   NOP
   ```
   this will bypass the check `colorId < colorCount` and always run the break code allowing to use colors out of range \
   **note:** this check runs only when you are the host. that is the reason why this color will not appear in lobbies that you join
3. **set the color**
   *only works on microsoft store versions* 
   1. open `%localappdata%\Packages\Innersloth.AmongUs_fw5x688tam7rm\SystemAppData\wgs`
   2. open a folder with a hex name twice (the path should look something like this: `...\wgs\000901F8A8129A63_00000000000000000000000076A26B27\F6A0FE3BD5314B23A42FBC30F26EB51F`
   3. delete any `.working` files
   4. open the three non `container.XX` files in your text editor of choice (ex. notepad++)
   5. find the one that has the line `"account": {` close to the start of the file
   6. find the line `"colorID": XX,` (where `XX` could be a number from 0-17)
   7. set `XX` to 18 (or higher) \
   **note:** if you join a lobby that you are not hosting with the color id 18
    then the color blue will be used (`(18 + 1) % 18` = 1 which is the id for blue)

---
**and now** the *crudely* made python 3 script that automates everything
```py
import os
import json

pid = "Innersloth.AmongUs_fw5x688tam7rm"

assembly = f"C:\\Program Files\\WindowsApps\\{pid}\\GameAssembly.dll"
if not os.path.exists(assembly):
   assembly = input("Please input the path to GameAssembly.dll:\n")

with open(assembly, "rb") as file:
   content = file.read()
ogcontent = content
content = content.replace(b'\x5a\x18\x7d\x41', b'\x5a\x18\x48\x90')
if ogcontent == content:
   print("Could not find the instruction to replace")
with open(assembly, "wb") as file:
   file.write(content)

config = os.path.join(os.getenv("localappdata"), f"Packages\\{pid}\\SystemAppData\\wgs")
updated = False

for i in os.listdir(config):
   path = os.path.join(config, i)
   if i != 't':
      for j in os.listdir(path):
         path2 = os.path.join(path, j)
         if 'container' not in j:
            for k in os.listdir(path2):
               path3 = os.path.join(path2, k)
               if 'container' not in k:
                  with open(path3, 'r', encoding='utf-8') as file:
                     content = file.read()
                  if '"account": {' in content:
                     content = json.loads(content)
                     content['customization']['colorID'] = 18
                     updated = True
                     with open(path3, 'w', encoding='utf-8') as file:
                        json.dump(content, file)
if not updated:
   print("Could not update player colorID")

print('Done!')
```
