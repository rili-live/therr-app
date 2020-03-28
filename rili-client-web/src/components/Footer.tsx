import * as React from 'react';
import { connect } from 'react-redux';
import AccessControl from 'rili-public-library/react-components/AccessControl.js';
import SvgButton from 'rili-public-library/react-components/SvgButton.js';
import { IUserState } from 'types/user';
import SocketActions from 'actions/Socket';
import { bindActionCreators } from 'redux';
import { INavMenuContext } from '../types';

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
      const { goHome, toggleNavMenu, isAuthorized } = this.props;

      return (
          <footer>
              <div className="footer-menu-item">
              </div>
              <div className="footer-menu-item">
                  <SvgButton id="footer_home" name="home" className="home-button" onClick={goHome} buttonType="primary" />
              </div>
              <div className="footer-menu-item">
                  <AccessControl isAuthorized={isAuthorized}>
                      <SvgButton
                          id="footer_messages"
                          name="messages"
                          className="messages-button"
                          onClick={(e) => toggleNavMenu(e, INavMenuContext.FOOTER_MESSAGES)}
                          buttonType="primary"
                      />
                  </AccessControl>
              </div>
          </footer>
      );
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(FooterComponent);
