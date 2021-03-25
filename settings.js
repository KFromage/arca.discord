
const process = require('process');

module.exports = {
  discord: {
    token: process.env['discord_token'],
    channelId: process.env['discord_channelid']
  },
  arcalive: {
    admin: {
      username: process.env['arcalive_admin_username'],
      password: process.env['arcalive_admin_password']
    },
    bot: {
      username: process.env['arcalive_username'],
      password: process.env['arcalive_password']
    }
  },
  server: {
    port: process.env['PORT']
  }
};