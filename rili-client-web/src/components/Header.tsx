import * as React from 'react';

interface IHeaderProps {
  showLogin?: boolean;
}

const Header: React.FunctionComponent<IHeaderProps> = ({ showLogin }) => (
  <header>
    { showLogin && <div className="login-link"><a href="/login">Login</a></div> }
  </header>
);

export default Header;