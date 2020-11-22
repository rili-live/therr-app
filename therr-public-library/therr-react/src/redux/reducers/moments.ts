import * as Immutable from 'seamless-immutable';
import { IMomentsState, MapActionTypes } from '../../types/redux/maps';

const initialState: IMomentsState = Immutable.from({
    moments: Immutable.from([]),
    myMoments: Immutable.from([]),
});

const moments = (state: IMomentsState = initialState, action: any) => {
    // If state is initialized by server-side rendering, it may not be a proper immutable object yet
    if (!state.setIn) {
        state = state ? Immutable.from(state) : initialState; // eslint-disable-line no-param-reassign
    }

    let modifiedMoment = [...state.moments];

    switch (action.type) {
        // TODO: Rethink this
        case MapActionTypes.GET_MOMENTS:
            return state.setIn(['moments'], action.data);
        case MapActionTypes.MOMENT_CREATED:
            modifiedMoment.unshift(action.data);
            return state.setIn(['myMoments'], modifiedMoment);
        case MapActionTypes.MOMENT_UPDATED:
            modifiedMoment = state.moments.map((moment) => { // eslint-disable-line no-case-declarations
                if (moment.id === action.data.id) {
                    return {
                        ...moment,
                        ...action.data,
                    };
                }

                return moment;
            });
            return state.setIn(['myMoments'], modifiedMoment);
        default:
            return state;
    }
};

export default moments;
