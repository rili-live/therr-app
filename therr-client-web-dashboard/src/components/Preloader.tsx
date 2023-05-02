import React from 'react';
import { Image } from '@themesberg/react-bootstrap';

const ReactLogo = '/assets/img/technologies/react-logo-transparent.svg';

const Preloader = (props: any) => {
    const { show } = props;

    return (
        <div className={`preloader bg-soft flex-column justify-content-center align-items-center ${show ? '' : 'show'}`}>
            <Image className="loader-element animate__animated animate__jackInTheBox" src={ReactLogo} height={40} />
        </div>
    );
};

export default Preloader;
