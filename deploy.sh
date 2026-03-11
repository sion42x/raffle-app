#!/bin/sh
cd ~/raffle-app
git pull origin main
docker compose up --build -d --force-recreate
