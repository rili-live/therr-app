import * as React from 'react';
import { Link } from 'react-router-dom';
import AccessControl from 'rili-public-library/react-components/AccessControl';

interface IHeaderProps {
  isAuthorized: boolean;
}

const Header: React.FunctionComponent<IHeaderProps> = ({ isAuthorized }) => (
  <header>
    <AccessControl isAuthorized={isAuthorized} publicOnly>
      <div className="login-link"><Link to="/login">Login</Link></div>
    </AccessControl>
  </header>
);

export default Header;