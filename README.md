# Alpha-Mode
Very raw. Could contain embarrassing code.

### Installation steps:
+ Navigate to the site's root folder in the terminal
+ Install binary dependencies: read `SETUP.md` for pre-installation steps
+ Install app: Run `nodejs install/app.js` 
+ Generate test data (optional): Run `nodejs install/demo.js`
+ Start app: Run `nodejs app.js`

***
### App routing plan: /:board/:page/:action? (simplicity is best, right?)

###### Common
* / - overboard index
* /_/ - underboard index
* /:board/ - board index

###### Global
* /_/index - underboard index alias
* /_/bans - list all bans for boards with public bans endabled (filterable)
* /_/banned - list all global and board level bans that your IP is affected by
* /_/logs - global moderator actions log (restricted access)
* /_/reports - list all reports that have been escalated to global (restricted access)

###### Boards
* /:board/index - board index alias
* /:board/:post - view thread or redirect to thread containing the post
* /:board/:page - custom board page
* /:board/catalog - board catalog
* /:board/banned - check if your IP is banned from requested board (includes global bans)
* /:board/bans - list all bans for requested board (restricted access if public bans disabled)
* /:board/logs - moderator actions log (restricted access if public logs disabled)
* /:board/reports - list all reports and affected posts for requested board (restricted access)
* /:board/settings - edit board settings (restricted access)
* /:board/pages - list all custom board pages (restricted access?)
* /:board/editPage - create a new custom board page (restricted access)
* /:board/editPage/:page - edit custom board page (restricted access)
* /:board/roles - view board roles and authorized users (restricted access)
* /:board/editRole - create a new role (restricted access)
* /:board/editRole/:role - edit an existing role (restricted access)