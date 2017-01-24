# Alpha-Mode
Very raw. Could contain embarrassing code.

### PLEASE READ `/SETUP.md` BEFORE ANYTHING ELSE

***
### App routing plan: /:board/:page/:action?/:data? (simplicity is best, right?)
#### GET cascade

* / - overboard

###### Global
* /_/(index)? - moderator frontpage view
* /_/bans - list all bans for boards with public bans endabled (filterable)
* /_/banned - list all global and board level bans that your IP is affected by
* /_/logs - global moderator actions log (restricted access)
* /_/reports - list all reports that have been escalated to global (restricted access)

###### Boards
* /:board/(index)? - board index
* /:board/:thread(\d+) - view thread or redirect to thread containing the post
* /:board/bans - list all bans for requested board (restricted access if public bans disabled)
* /:board/banned - check if your IP is banned from requested board (includes global bans)
* /:board/catalog - board catalog
* /:board/logs - moderator actions log (restricted access if public logs disabled)
* /:board/reports - list all reports and affected posts for requested board (restricted access)
* /:board/pages - list all custom board pages (restricted access?)
* /:board/pages/new - create new custom board page (restricted access)
* /:board/settings - edit board settings (restricted access)
* /:board/:page(\w\*[a-zA-Z_]\w\*) - custom board page
* /:board/:page(\w\*[a-zA-Z_]\w\*)/edit - edit custom board page (restricted access)

#### POST cascade

* /:board/ - post as a new thread
* /:board/:thread(\d+) - post as a thread reply
* /:board/pages/new - save new custom board page (restricted access)
* /:board/settings - update board settings (restricted access)
* /:board/:page(\w\*[a-zA-Z_]\w\*)/edit - update custom board page (restricted access)
