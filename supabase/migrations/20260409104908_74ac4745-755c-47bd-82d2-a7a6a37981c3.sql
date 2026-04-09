
-- Allow reviewers to delete their own reviews
CREATE POLICY "Reviewers can delete own reviews"
ON public.performance_reviews
FOR DELETE
TO authenticated
USING (auth.uid() = reviewer_id);

-- Allow admins/moderators to delete any review
CREATE POLICY "Admins can delete any review"
ON public.performance_reviews
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')
);

-- Allow deletion of scores when the parent review's reviewer is the current user
CREATE POLICY "Reviewers can delete own review scores"
ON public.performance_review_scores
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.performance_reviews
    WHERE id = performance_review_scores.review_id
    AND reviewer_id = auth.uid()
  )
);

-- Allow admins/moderators to delete any scores
CREATE POLICY "Admins can delete any review scores"
ON public.performance_review_scores
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')
);
