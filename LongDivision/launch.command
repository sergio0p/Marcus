#!/bin/bash
# Double-click to launch the LongDivision app in Chrome --app mode.
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
URL="file://$DIR/index.html"
open -na "Google Chrome" --args --app="$URL"
