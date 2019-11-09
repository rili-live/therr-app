#!/bin/sh

{ \
  echo USER=bob \
  echo SOMETHING="$SOMETHING"
} > somefile.env

exec "$@"