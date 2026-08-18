#!/usr/bin/env sh
# Run both apps in dev: backend on :4000, frontend on :3000.
#
# backend/ and frontend/ are independent projects with their own dependencies, so
# this just starts each one in place. Run `npm run install:all` first.
#
# `kill 0` signals the whole process group, which is what stops the Next.js and
# tsx child processes too — killing just the two npm wrappers can leave those
# orphaned and holding the ports. Ctrl-C, SIGTERM and normal exit all route here.
trap 'kill 0' EXIT INT TERM

npm --prefix backend run dev &
npm --prefix frontend run dev &

wait
