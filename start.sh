#!/bin/sh

respath=default

if [ -n "$1" ]
then
    respath=$1
fi


createAppJsObj CMS main.js $1
createAppJsObj CMSRes resource.js $1
gosu root python -m http.server 80 -d../../data/${respath}/cms/resource/&
