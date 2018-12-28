import * as React from 'react';
import App from '../app';
import { mount } from 'enzyme'; // tslint:disable-line no-implicit-dependencies

describe('Rili App', () => {
    let wrapper: any = null;

    function mountWithProps(props = {}) {
        if (wrapper) {
            wrapper.unmount();
            wrapper = null;
        }

        wrapper = mount(
            <App {...props} />,
        );
    }

    beforeEach(() => {
        wrapper = null;
    });

    it('Example test', () => {
        mountWithProps({});
        expect(wrapper.length).toBe(1);
    });
});
