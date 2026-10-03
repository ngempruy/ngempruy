import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/outline";

type PaginationButtonProps = {
  currentPage: number;
  totalItems: number;
  setCurrentPage: (page: number) => void;
};

const ITEMS_PER_PAGE = 20;

export const PaginationButton = ({ currentPage, totalItems, setCurrentPage }: PaginationButtonProps) => {
  const isPrevButtonDisabled = currentPage === 0;
  const isNextButtonDisabled = currentPage + 1 >= Math.ceil(totalItems / ITEMS_PER_PAGE);

  const prevButtonClass = isPrevButtonDisabled ? "btn-disabled cursor-default" : "btn-primary";
  const nextButtonClass = isNextButtonDisabled ? "btn-disabled cursor-default" : "btn-primary";

  if (isNextButtonDisabled && isPrevButtonDisabled) return null;

  return (
    <div className="mx-5 mt-5 flex justify-end gap-3">
      <button
        className={`btn btn-sm ${prevButtonClass}`}
        disabled={isPrevButtonDisabled}
        onClick={() => setCurrentPage(currentPage - 1)}
      >
        <ArrowLeftIcon className="h-4 w-4" />
      </button>
      <span className="text-primary-content self-center font-medium">Page {currentPage + 1}</span>
      <button
        className={`btn btn-sm ${nextButtonClass}`}
        disabled={isNextButtonDisabled}
        onClick={() => setCurrentPage(currentPage + 1)}
      >
        <ArrowRightIcon className="h-4 w-4" />
      </button>
    </div>
  );
};
