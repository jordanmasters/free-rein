#!/bin/sh
# refuse a force push
grep -q -- '--force' && { echo "no force pushes" >&2; exit 2; }
exit 0
