#!/bin/sh

if [ -z "$PUID" ] || [ -z "$PGID" ]; then
  echo "$(whoami) ALL=(ALL) NOPASSWD: /usr/bin/mount, /usr/bin/umount" >> /etc/sudoers
  exec npm start
else
  groupadd abc -g $PGID
  useradd abc -u $PUID -g $PGID

  echo "abc ALL=(ALL) NOPASSWD: /usr/bin/mount, /usr/bin/umount" >> /etc/sudoers

  chown abc:abc -R /app

  exec su -c 'npm start' abc
fi
