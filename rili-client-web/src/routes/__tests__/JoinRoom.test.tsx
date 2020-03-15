import * as React from 'react';
import { mount } from 'enzyme';
import { JoinRoomComponent } from '../JoinRoom';

describe('Rili App', () => {
    let wrapper: any = null;

    function mountWithProps(props = {}) {
        const Home = JoinRoomComponent as any;
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
