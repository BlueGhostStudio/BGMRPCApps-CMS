#!/bin/sh

detachAppObj CMS $1
detachAppObj CMSRes $1

ps -ef | grep 'python -m http.server' | awk '{print $2}' | xargs kill -9
