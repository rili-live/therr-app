import * as React from 'react';

interface IProps {
    id: string;
    isOpen: boolean;
    contentLabel: string;
    overlayClassName: string;
    className: any;
    shouldCloseOnOverlayClick(): void;
    onRequestClose(): void;
    parentSelector: any;
    onAfterOpen(): void;
}

export default class MockReactModal extends React.Component < IProps, any > {
    static setAppElement() {
        // in our application we use #setAppElement for accessibility
        // if you use this or any other functions you'll have to mock them
    }

    render() {
        return (
            <div id={this.props.id}> {this.props.isOpen && this.props.children}
            </div>
        );
    }
}
