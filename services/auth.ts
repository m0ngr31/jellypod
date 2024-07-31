import config from './config';

const AuthService = {
  login: (user, token) => {
    AuthService.setUser(user);
    AuthService.setToken(token);
  },
  logout: () => {
    config.removeItem('api-token');
    config.removeItem('server');
    config.removeItem('user');
  },
  setToken: token => {
    config.setItem('api-token', token);
  },
  setUser: userData => {
    config.setItem('user', userData);
  },
};

export default AuthService;
