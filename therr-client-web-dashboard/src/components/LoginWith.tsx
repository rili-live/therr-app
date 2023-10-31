import { faFacebookF } from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import * as React from 'react';
import { Button } from 'react-bootstrap';

type OAuthProviders = 'facebook';

interface ILoginWith {
    onClick: (provider: OAuthProviders) => any,
}

const LoginWith = ({
    onClick,
}: ILoginWith) => (
    <div className="d-flex justify-content-center my-4">
        <Button variant='outline-light' className='btn-icon-only btn-pill text-facebook me-2' onClick={() => onClick('facebook')}>
            <FontAwesomeIcon icon={faFacebookF} />
        </Button>
        {/* <Button variant="outline-light" className="btn-icon-only btn-pill text-twitter me-2">
            <FontAwesomeIcon icon={faTwitter} />
        </Button>
        <Button variant="outline-light" className="btn-icon-only btn-pil text-dark">
            <FontAwesomeIcon icon={faGithub} />
        </Button> */}
    </div>
);

export default LoginWith;
