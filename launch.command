#!/bin/bash
# Double-click to launch the Division app in Chrome --app mode.
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
URL="file://$DIR/division.html"
open -na "Google Chrome" --args --app="$URL"
