import * as React from 'react';
import { HomeComponent } from '../home';
import { mount } from 'enzyme'; // tslint:disable-line no-implicit-dependencies

describe('Rili App', () => {
    let wrapper: any = null;

    function mountWithProps(props = {}) {
        const Home = HomeComponent as any;
        if (wrapper) {
            wrapper.unmount();
            wrapper = null;
        }

        wrapper = mount(
            <Home {...props} />,
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
