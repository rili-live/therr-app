export default ({ totalItems, itemsPerPage, pageNumber }, visiblePageButtons = 5) => {
    let endPage;
    let startPage;
    const totalPages = totalItems ?
        Math.ceil(totalItems / itemsPerPage) :
        0;

    const currentPage = pageNumber;
    const pageList = [];
    const visibleFloor = Math.floor(visiblePageButtons / 2);

    for (let i = 0; i < totalPages; i += 1) {
        pageList.push({
            pageNumber: i + 1,
        });
    }
    if (totalPages <= visiblePageButtons) {
        startPage = 1;
        endPage = totalPages;
    } else if (currentPage <= visibleFloor) {
        startPage = 1;
        endPage = visiblePageButtons;
    } else if (currentPage + visibleFloor >= totalPages) {
        startPage = totalPages - (visiblePageButtons - 1);
        endPage = totalPages;
    } else if (visiblePageButtons % 2 === 0) {
        startPage = currentPage - visibleFloor;
        endPage = currentPage + (visibleFloor - 1);
    } else {
        // Keep current page in center if visible page numbers is an odd number
        startPage = currentPage - visibleFloor;
        endPage = currentPage + visibleFloor;
    }

    const pageListSlice = pageList.slice(startPage - 1, endPage);

    return {
        pagesList: pageListSlice,
        totalPages,
    };
};
