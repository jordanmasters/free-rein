#!/bin/bash
# Refuses force pushes.
grep -q -- '--force' && exit 2
exit 0
