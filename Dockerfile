FROM ubuntu:22.04

ENV LANG="en_US.UTF-8" \
  LANGUAGE="en_US.UTF-8" \
  LC_ALL="en_US.UTF-8" \
  DEBIAN_FRONTEND=noninteractive \
  TZ=America/Denver

RUN apt-get update
RUN apt-get upgrade -y
RUN apt-get install curl -y

RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -

RUN apt-get install nodejs gnupod-tools cifs-utils sudo patch build-essential -y

RUN rm -rf /var/cache/apk/*

RUN mkdir /app
WORKDIR /app

COPY . .

RUN \
  patch --ignore-whitespace -u /usr/bin/gnupod_addsong -i /app/diff/gnupod_addsong.patch && \
  patch --ignore-whitespace -u /usr/bin/gnupod_convert_FLAC -i /app/diff/gnupod_convert_FLAC.patch

RUN \
  cd /app && \
  npm ci

RUN chmod +x entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]
