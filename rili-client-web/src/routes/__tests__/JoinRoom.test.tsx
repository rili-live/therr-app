import * as React from 'react';
import { JoinRoomComponent } from '../JoinRoom';
import { mount } from 'enzyme';

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
