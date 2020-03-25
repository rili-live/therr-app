import * as React from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import SvgButton from 'rili-public-library/react-components/SvgButton.js';
import { IUserState } from 'types/user';
import SocketActions from 'actions/Socket';
import { bindActionCreators } from 'redux';

interface IFooterDispatchProps {
    logout: Function;
}

interface IStoreProps extends IFooterDispatchProps {
    user: IUserState;
}

// Regular component props
interface IFooterProps extends IStoreProps {
  goHome: Function;
  isAuthorized: boolean;
  toggleNavMenu: Function;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    logout: SocketActions.logout,
}, dispatch);

export class FooterComponent extends React.Component<IFooterProps> {
  handleLogout = () => {
      const { logout, user, goHome } = this.props;

      logout(user.details).then(() => {
          goHome();
      });
  }

  render() {
      const { goHome, toggleNavMenu } = this.props;

      return (
          <footer>
              <div className="footer-menu-item">
              </div>
              <div className="footer-menu-item">
                  <SvgButton id="home" name="home" className="home-button" onClick={goHome} buttonType="primary" />
              </div>
              <div className="footer-menu-item">
                  <SvgButton
                      id="messages"
                      name="messages"
                      className="messages-button"
                      onClick={toggleNavMenu}
                      buttonType="primary"
                  />
              </div>
          </footer>
      );
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(FooterComponent);
