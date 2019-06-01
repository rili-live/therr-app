import * as React from 'react';
import { Link } from 'react-router-dom';

interface IHeaderProps {
  showLogin?: boolean;
}

const Header: React.FunctionComponent<IHeaderProps> = ({ showLogin }) => (
  <header>
    { showLogin && <div className="login-link"><Link to="/login">Login</Link></div> }
  </header>
);

export default Header;