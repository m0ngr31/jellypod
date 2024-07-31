# jellypod

jellypod is a Docker-based application that integrates with Jellyfin for managing and syncing music, and with Audiobookshelf to sync podcasts and audiobooks (I prefer using Audiobookshelf for podcasts and audiobooks, but you can just skip this if you're only syncing your music).

## Prerequisites

- Jellyfin instance
- iPod (tested on 6th gen iPod Classic) setup with GNUpod already
- Docker
- Docker Compose

I am leaving setting up GNUpod on your iPod to the user. At this time, I'm not documenting that procedure. It is recommended to start with a freshly formatted iPod.

## Limitations

Too many to name really... This was mostly a fun project to see if it was possible. I'm sure there is a better way of doing almost all of this, but this is what I ended up with.

Here's some of the main ones:
* You have to figure out how to setup GNUpod on your own
* Not syncing playlists yet
* Created playlists aren't "self-cleaning" - so if you unlike a song, it will still show in the "Favorites" playlist. Same with instant mixes playlists
* Podcasts don't get deleted at all, they just keep getting added
* If you lose your `./data` volume, and try to sync again, you will duplicate all the songs. **If you lose that volume, you need to delete all the music files off of your iPod (can do it by hand), and replace the `GNUtunesDB.xml` file on your iPod with the one in the `misc` folder of this project**


## Quick Start

1. Clone this repository or download `docker-compose.yml` file
2. Configure the environment variables in the `docker-compose.yml` file
3. Run `docker-compose up`

## Configuration

### Environment Variables

| Variable | Description | Required | Example |
|----------|-------------|----------|----------|
| JELLYFIN_URL | URL of your Jellyfin server | Yes | http://192.168.1.150:8096 |
| JELLYFIN_USER | Jellyfin username | Yes | Demo User |
| JELLYFIN_PASS | Jellyfin password | Yes | d3m0u$3r |
| INSTANT_MIXES | Instant Mixes you want. Find the UUID of a song, album, artist, genre, ect. and put `::` between that and the name you want the playlist to be. Comma seperated values | No | 02e07724fc335bb75025187d04d87bff::Post Rock Radio,e1a463af703d830c1106c15fa2b65a9f::Modest Mouse Radio |
| ALLOWED_BOOKS | List of allowed books. Please note that it will only add books that are in m4b format. It works as a simple string search and will match with many books. For example: `dune` will match Dune, Dune Messiah, ect. Comma seperated values | Only if you're syncing audiobooks | dune,martian |
| MUSIC_MOUNT | SMB mount point for music. **This must match the library from Jellyfin** | Yes | //192.168.1.150/media/Music |
| PODCASTS_MOUNT | SMB mount point for podcasts from Audiobookshelf | No | //192.168.1.150/media/Podcasts |
| AUDIOBOOKS_MOUNT | SMB mount point for audiobooks from Audiobookshelf | No | //192.168.1.150/media/Audiobooks |
| SYNC_AUDIOBOOKS | Enable audiobook syncing (true/false) | No | true |
| SYNC_PODCASTS | Enable podcast syncing (true/false) | No | true |
| SMB_USER | SMB username (default: guest) | No | guest |
| SMB_PASSWORD | SMB password | No | |
| PGID | Group ID for file permissions | Recommended | 1000 |
| PUID | User ID for file permissions | Recommended | 1000 |

### Volumes

| Host Path | Container Path | Description |
|-----------|----------------|-------------|
| ./data | /app/data | Application data directory |
| /media/user/IPOD | /ipod | Mount point for iPod |

## Notes

- Ensure that the host paths for volumes exist before starting the container.
- Adjust the PGID and PUID environment variables to match your host system's user and group IDs for proper file permissions.
- The SMB_USER is set to "guest" by default. Change this if you need authenticated SMB access.

## Security Considerations

This container runs in privileged mode and has SYS_ADMIN capabilities. Ensure that you understand the security implications of running containers with elevated privileges.