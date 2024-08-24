# Discord Subsonic Music Bot

#### A music bot that connects Discord and a subsonic server.

### Installation

1. Clone repository:

```shell
git clone https://github.com/zlyfer/subsonic-music-bot
```

2. Install packages:

```shell
npm install
```

3. Copy `credentials.template.json` to `credentials.json`.
4. Insert your credentials into `credentials.json`. You can add as many subsonic servers as you want:

Example (**not actual credentials!**):

```json
{
  "version": 2,
  "discord": {
    "token": "ASDgjDFHG5SDg3SGTaDFG5H3.DFGgfC.5DFGg3SFbGRF3EFsdf-SD2as_Da2Av_ASdxAGd",
    "client_id": "342087563429345872"
  },
  "subsonic": [
    {
      "name": "Server 1",
      "protocol": "https",
      "host": "example.com",
      "port": "4533",
      "username": "sk4terb0y",
      "password": "cul8erboy"
    },
    {
      "name": "Server 2",
      "protocol": "http",
      "host": "localhost",
      "port": "80",
      "username": "admin",
      "password": "4dM1n"
    }
  ]
}
```
