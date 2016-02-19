# alpha
Very raw. Could contain embarrassing code.

===
### App routing plan
#### GET cascade: /board/action/ (simplicity is best, right?)

* / - overboard

######Global
* /_/ - user/moderator view
* /_/bans - list all bans for boards with public bans endabled (filterable)
* /_/banned - list all global and board level bans that your IP is affected by
* /_/index - user/moderator view
* /_/logs - global moderator actions log (restricted access)
* /_/reports - list all reports that have been escalated to global (restricted access)
* /_/\* - 404

######Boards
* /\*/ - board index
* /\*/[0-9]\* - view thread
* /\*/bans - list all bans for requested board (restricted access if public bans disabled)
* /\*/banned - check if your IP is banned from requested board (including globally)
* /\*/catalog - board catalog
* /\*/index - board index
* /\*/logs - moderator actions log (restricted access if public logs disabled)
* /\*/reports - list all reports and affected posts for requested board (restricted access)
* /\*/settings - board settings
* /\*/\* - custom board page OR 404

#### Additional POST cascade

* /\*/ - Post as a new thread
* /\*/[0-9]\* - Post as a thread reply
