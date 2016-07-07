# alpha
Very raw. Could contain embarrassing code.

===
#### Requirements
- Postgres 9.5.0 or greater
- Imagemagick 6.9.0 or greater
- Redis 3.0 or greater

===
### App routing plan: /:board/:page/:action?/:data? (simplicity is best, right?)

* / - overboard

###### Global
* /_/ - moderator frontpage view
* /_/index - moderator frontpage view
* /_/bans - list all bans for boards with public bans endabled (filterable)
* /_/banned - list all global and board level bans that your IP is affected by
* /_/logs - global moderator actions log (restricted access)
* /_/reports - list all reports that have been escalated to global (restricted access)

###### Boards
* /:board/ - board index
* /:board/index - board index
* /:board/:thread(\d+) - view thread or redirect to thread containing the post
* /:board/bans - list all bans for requested board (restricted access if public bans disabled)
* /:board/banned - check if your IP is banned from requested board (including globally)
* /:board/catalog - board catalog
* /:board/logs - moderator actions log (restricted access if public logs disabled)
* /:board/reports - list all reports and affected posts for requested board (restricted access)
* /:board/pages - list all custom board pages
* /:board/settings - edit board settings (restricted access)
* /:board/:page(\w*[a-zA-Z_]\w*) - custom board page
