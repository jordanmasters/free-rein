#!/bin/bash
# Refuses edits to the vault — exits 2 to block.
# # nested marker
# Second line of header.
case "$1" in vault/*) exit 2;; esac
